import aBetterWay from "./a-better-way.svelte";
import keyIdea from "./key-idea.svelte";
import optionsAndEnhancements from "./options-and-enhancements.svelte";
import scrollingPosition from "./scrolling-position.svelte";
import whatWeNeed from "./what-we-need.svelte";

export const data = [
  {
    icon: "carbon:idea",
    title: "The Key Idea",
    Content: keyIdea,
    thumbnail: "https://picsum.photos/720/560"
  },
  {
    icon: "clarity:design-line",
    title: "What we need",
    Content: whatWeNeed,
    thumbnail: "https://picsum.photos/720/560"
  },
  {
    icon: "carbon:education",
    title: "Scroll Position",
    Content: scrollingPosition,
    thumbnail: "https://picsum.photos/720/560"
  },
  {
    icon: "carbon:lightning",
    title: "A better way",
    Content: aBetterWay,
    thumbnail: "https://picsum.photos/720/560"
  },
  {
    icon: "carbon:tools",
    title: "Options & Enhancements",
    Content: optionsAndEnhancements,
    thumbnail: "https://picsum.photos/720/560"
  },
];

let isTrigger = $state(false);
let activeIndex = $state(0);

export const useScrollingTabs = () => {
  return {
    set isTrigger(value) {
      isTrigger = value;
    },
    get isTrigger() {
      return isTrigger;
    },
    get activeIndex() {
      return activeIndex;
    },
    set activeIndex(value) {
      activeIndex = value;
    },
    data,
  }
};
