-- ==========================================
-- 1. ENUMS & TYPES
-- ==========================================
-- Define standard values to keep data clean
create type user_role as enum ('admin', 'contractor', 'subcontractor');
create type job_status as enum ('open', 'completed', 'cancelled');
create type assignment_status as enum ('pending', 'accepted', 'rejected');
create type doc_type as enum ('invoice', 'general');

-- ==========================================
-- 2. TABLES
-- ==========================================

-- PROFILES: Public profile info, linked to auth.users
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text,
  role user_role, -- Nullable initially (for onboarding flow)
  created_at timestamptz default now()
);

-- JOBS: Posted by contractors
create table public.jobs (
  id uuid default gen_random_uuid() primary key,
  contractor_id uuid references public.profiles(id) not null,
  title text not null,
  description text,
  status job_status default 'open',
  created_at timestamptz default now()
);

-- JOB ASSIGNMENTS: Connects Subcontractors to Jobs
create table public.job_assignments (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.jobs(id) on delete cascade not null,
  subcontractor_id uuid references public.profiles(id) not null,
  status assignment_status default 'pending',
  created_at timestamptz default now(),
  
  -- Prevent a subcontractor from applying to the same job twice
  unique(job_id, subcontractor_id)
);

-- DOCUMENTS: Stores file references and OCR data
create table public.documents (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.jobs(id) on delete cascade not null,
  uploader_id uuid references public.profiles(id) not null,
  type doc_type default 'general',
  file_path text not null, -- Path in Supabase Storage bucket
  
  -- Extracted OCR Data (Specific columns for easy querying)
  invoice_number text,
  invoice_total numeric(10, 2), -- 10 digits total, 2 decimal places
  invoice_date date,
  
  -- Raw AI/OCR response (Flexibility for future data)
  ocr_raw_data jsonb,
  
  created_at timestamptz default now()
);

-- ==========================================
-- 3. AUTOMATION & TRIGGERS
-- ==========================================

-- Function to handle new user signup (Google/Email)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    -- Try to get name from Google metadata, default to empty string if missing
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    NULL -- Role is NULL by default; user must select it during onboarding
  );
  return new;
end;
$$;

-- Trigger: Runs every time a user signs up
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Dedicated function for onboarding role selection
-- Runs as db owner (security definer), so it bypasses RLS
create or replace function public.set_my_role(new_role user_role)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if new_role not in ('contractor', 'subcontractor') then
    raise exception 'Invalid role';
  end if;

  update public.profiles
    set role = new_role
    where id = auth.uid()
    and role is null;  -- Only works if role hasn't been set yet

  if not found then
    raise exception 'Role already set';
  end if;
end;
$$;

-- ==========================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.job_assignments enable row level security;
alter table public.documents enable row level security;

-- Helper Function: Gets the current user's role to simplify policies
-- Note: We use 'stable' so it doesn't re-query for every single row
create or replace function public.get_my_role()
returns user_role
language sql
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ------------------------------------------
-- 4.1 PROFILES POLICIES
-- ------------------------------------------

-- Users can read their own profile
create policy "Users view own profile"
on public.profiles for select
using ( auth.uid() = id );

-- Admin: Can view all profiles (to manage users)
create policy "Admin view all profiles"
on public.profiles for select
using ( public.get_my_role() = 'admin' );

-- ------------------------------------------
-- 4.2 JOBS POLICIES
-- ------------------------------------------

-- Contractors: Can create their own jobs
create policy "Contractors create own jobs"
on public.jobs for insert
with check (
  auth.uid() = contractor_id
  and public.get_my_role() = 'contractor'
);

-- Contractors: Can view their own jobs
create policy "Contractors view own jobs"
on public.jobs for select
using (
  auth.uid() = contractor_id
  and public.get_my_role() = 'contractor'
);

-- Admin: Full control over all jobs
create policy "Admin manage all jobs"
on public.jobs for all
using ( public.get_my_role() = 'admin' );

-- Subcontractors: Can view OPEN jobs (to browse/apply)
create policy "Subcontractors view open jobs"
on public.jobs for select
using ( 
  status = 'open' 
  and public.get_my_role() = 'subcontractor' 
);

-- Subcontractors: Can view jobs they are assigned to (even if closed)
create policy "Subcontractors view assigned jobs"
on public.jobs for select
using (
  exists (
    select 1 from public.job_assignments ja
    where ja.job_id = public.jobs.id
    and ja.subcontractor_id = auth.uid()
  )
);

-- ------------------------------------------
-- 4.3 JOB ASSIGNMENTS (APPLICATIONS) POLICIES
-- ------------------------------------------

-- Subcontractors: View their own applications
create policy "Subcontractors view own applications"
on public.job_assignments for select
using ( subcontractor_id = auth.uid() );

-- Subcontractors: Create an application (Insert)
create policy "Subcontractors can apply"
on public.job_assignments for insert
with check ( 
  subcontractor_id = auth.uid() 
  and public.get_my_role() = 'subcontractor'
);

-- Contractors: View applications for their jobs
create policy "Contractors view job applications"
on public.job_assignments for select
using (
  exists (
    select 1 from public.jobs
    where public.jobs.id = public.job_assignments.job_id
    and public.jobs.contractor_id = auth.uid()
  )
);

-- Contractors: Update application status (Accept/Reject)
create policy "Contractors update application status"
on public.job_assignments for update
using (
  exists (
    select 1 from public.jobs
    where public.jobs.id = public.job_assignments.job_id
    and public.jobs.contractor_id = auth.uid()
  )
);

-- Admin: Full control over all assignments
create policy "Admin manage all assignments"
on public.job_assignments for all
using ( public.get_my_role() = 'admin' );

-- ------------------------------------------
-- 4.4 DOCUMENTS POLICIES
-- ------------------------------------------

-- Users (both roles) see their own uploads
create policy "Users see own documents"
on public.documents for select
using ( uploader_id = auth.uid() );

-- Subcontractors: Upload documents to jobs they are assigned to
create policy "Subcontractors upload documents"
on public.documents for insert
with check ( 
  uploader_id = auth.uid() 
  and public.get_my_role() = 'subcontractor'
  -- Optional: Ensure they are actually assigned to the job first
  and exists (
    select 1 from public.job_assignments ja
    where ja.job_id = public.documents.job_id
    and ja.subcontractor_id = auth.uid()
    and ja.status = 'accepted'
  )
);

-- Contractors: View documents for their jobs
create policy "Contractors see job documents"
on public.documents for select
using (
  exists (
    select 1 from public.jobs
    where public.jobs.id = public.documents.job_id
    and public.jobs.contractor_id = auth.uid()
  )
);

-- Admin: Full control over all documents
create policy "Admin manage all documents"
on public.documents for all
using ( public.get_my_role() = 'admin' );