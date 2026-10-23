"""Retarget a public transaction-trained SetFit encoder; ship ONNX + a JSON head, never pickle."""
import json, subprocess, hashlib
from pathlib import Path
import numpy as np
import torch
import onnxruntime as ort
from onnxruntime.quantization import quantize_dynamic, QuantType
from sentence_transformers import SentenceTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix
from setfit import SetFitModel, TrainingArguments, Trainer
from datasets import Dataset

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'static/models/ledgerclean-setfit-v1'
SOURCE = 'maaz-zaidi/transaction-classifier-setfit'
REVISION = '7425982167ac525d5ae26ebf66367e247398cccd'
torch.set_num_threads(4)
examples = json.loads(Path(__file__).with_name('examples.json').read_text())
presets = json.loads(subprocess.check_output(['bun', '-e', "import {CATEGORY_PRESETS} from './src/lib/tools/ledgerclean/categories.ts';console.log(JSON.stringify(CATEGORY_PRESETS))"], cwd=ROOT, text=True))
keys = [key for key, value in presets.items() if value['kind'] == 'expense' and value['parentId'] is None]
assert set(keys) == set(examples['train']) == set(examples['test'])
OUTPUT.mkdir(parents=True, exist_ok=True)
# SentenceTransformer reads only the safe tensor body, not the upstream model_head.pkl.
model = SentenceTransformer(SOURCE, revision=REVISION, trust_remote_code=False, device='cpu', model_kwargs={'use_safetensors': True})
# A bounded contrastive pass adapts the transaction encoder to our eight root labels.
training = [(text, keys.index(key)) for key in keys for text in examples['train'][key]]
setfit = SetFitModel(model_body=model, model_head=LogisticRegression(C=10, max_iter=2000), normalize_embeddings=True, labels=keys)
args = TrainingArguments(batch_size=16, num_epochs=1, max_steps=300, num_iterations=5,
    body_learning_rate=2e-5, seed=42, report_to='none', save_strategy='no', output_dir='/tmp/ledger-setfit/training', use_amp=False)
trainer = Trainer(model=setfit, args=args, train_dataset=Dataset.from_dict({'text':[text for text,_ in training], 'label':[label for _,label in training]}))
trainer.train()
print('Contrastive adaptation complete', flush=True)
model.eval()
model[0].auto_model.save_pretrained(OUTPUT, safe_serialization=True)
model.tokenizer.model_max_length = 128
model.tokenizer.save_pretrained(OUTPUT)
(OUTPUT / 'model.safetensors').unlink() # Only the exported, quantized ONNX body is shipped.
(OUTPUT / 'onnx').mkdir(exist_ok=True)
class Encoder(torch.nn.Module):
    def __init__(self, body):
        super().__init__(); self.body = body
    def forward(self, input_ids, attention_mask, token_type_ids):
        return self.body(input_ids=input_ids, attention_mask=attention_mask, token_type_ids=token_type_ids).last_hidden_state
batch = model.tokenizer(['sample merchant'], return_tensors='pt')
float_path = OUTPUT / 'onnx/model.onnx'
with torch.no_grad():
    torch.onnx.export(Encoder(model[0].auto_model), (batch['input_ids'], batch['attention_mask'], batch['token_type_ids']), str(float_path),
        input_names=['input_ids','attention_mask','token_type_ids'], output_names=['last_hidden_state'],
        dynamic_axes={name:{0:'batch',1:'sequence'} for name in ['input_ids','attention_mask','token_type_ids','last_hidden_state']},
        opset_version=17, dynamo=False)
quant_path = OUTPUT / 'onnx/model_quantized.onnx'
quantize_dynamic(str(float_path), str(quant_path), weight_type=QuantType.QUInt8)
float_path.unlink()
session = ort.InferenceSession(str(quant_path), providers=['CPUExecutionProvider'])
def encode(texts):
    all_vectors=[]
    for start in range(0,len(texts),16):
        tokens=model.tokenizer([text.lower() for text in texts[start:start+16]], padding=True, truncation=True, max_length=128, return_tensors='np')
        hidden=session.run(None, {key:tokens[key].astype(np.int64) for key in ['input_ids','attention_mask','token_type_ids']})[0]
        mask=tokens['attention_mask'][...,None]
        vectors=(hidden*mask).sum(1)/mask.sum(1)
        vectors/=np.maximum(np.linalg.norm(vectors,axis=1,keepdims=True),1e-12)
        all_vectors.extend(vectors)
    return np.asarray(all_vectors)
def rows(split):
    return [(text,key) for key in keys for text in examples[split][key]]
train, test=rows('train'), rows('test')
train_vectors=encode([text for text,_ in train]); test_vectors=encode([text for text,_ in test])
head=LogisticRegression(C=10, max_iter=2000, class_weight='balanced', random_state=42)
head.fit(train_vectors, [keys.index(key) for _,key in train])
probabilities=head.predict_proba(test_vectors); predicted=probabilities.argmax(1)
expected=[keys.index(key) for _,key in test]
report={
 'scope':'Developer-curated smoke benchmark, not independent real-world accuracy. Brand variants occur across splits.',
 'trainCount':len(train),'testCount':len(test),'accuracy':float(accuracy_score(expected,predicted)),
 'confusionMatrix':confusion_matrix(expected,predicted).tolist(),
 'cases':[{'description':text,'expected':key,'predicted':keys[int(prediction)],'score':round(float(p.max()),4),'margin':round(float(np.sort(p)[-1]-np.sort(p)[-2]),4)} for (text,key),prediction,p in zip(test,predicted,probabilities)]
}
artifact={
 'version':1, 'dimension':384,
 'source':{'repo':SOURCE,'revision':REVISION,'license':'Apache-2.0'},
 'labels':[{'categoryId':presets[key]['id'],'name':presets[key]['name']} for key in keys],
 'weights':head.coef_.tolist(),'intercepts':head.intercept_.tolist(),
 'encoderSha256':hashlib.sha256(quant_path.read_bytes()).hexdigest(),
 'training':{'examples':len(train),'method':'Transaction-trained SetFit body, 300 contrastive adaptation steps, retargeted logistic head','normalizedEmbeddings':True}
}
(ROOT / 'src/lib/tools/ledgerclean/setfit-head.json').write_text(json.dumps(artifact,separators=(',',':'))+'\n')
Path(__file__).with_name('evaluation.json').write_text(json.dumps(report,indent=2)+'\n')
size=sum(path.stat().st_size for path in OUTPUT.rglob('*') if path.is_file())
assert size<390_000_000, f'Assets exceed client budget: {size}'
print(json.dumps({'bytes':size,'smokeAccuracy':report['accuracy'],'cases':report['cases']},indent=2),flush=True)
