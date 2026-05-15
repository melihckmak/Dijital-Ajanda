ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category text DEFAULT 'Görev';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_completed boolean DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to uuid;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS subtasks jsonb DEFAULT '[]'::jsonb;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_starred boolean DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deadline date;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date date DEFAULT CURRENT_DATE;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS diary_pin text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text;
-- PUSH BİLDİRİMLERİ İÇİN YENİ EKLENEN SÜTUN:
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expo_push_token text;
-- POMODORO VE TEMA İÇİN YENİ EKLENEN SÜTUNLAR:
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_focus_minutes integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme_preference text DEFAULT 'light';

ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS invite_message text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS response_message text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS invite_seen boolean DEFAULT false;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS role text DEFAULT 'member';

-- 1. YENİ TABLOLARI OLUŞTURMA
CREATE TABLE IF NOT EXISTS journals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id bigint REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  comment text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS task_files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id bigint REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  version text DEFAULT 'v1.0',
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_resources (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text DEFAULT 'Bekliyor',
  cost numeric DEFAULT 0,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS org_meetings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  summary text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- ANKET / KARAR MODÜLÜ TABLOLARI:
CREATE TABLE IF NOT EXISTS org_polls (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  question text NOT NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_poll_options (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id uuid REFERENCES org_polls(id) ON DELETE CASCADE,
  option_text text NOT NULL
);

CREATE TABLE IF NOT EXISTS org_poll_votes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id uuid REFERENCES org_polls(id) ON DELETE CASCADE,
  option_id uuid REFERENCES org_poll_options(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE(poll_id, user_id) -- Bir kullanıcı bir ankette sadece 1 oy kullanabilir
);
INSERT INTO public.profiles (id, full_name)
SELECT id, 'İsimsiz Kullanıcı' FROM auth.users
ON CONFLICT (id) DO NOTHING;

UPDATE tasks SET assigned_to = NULL WHERE assigned_to IS NOT NULL AND assigned_to NOT IN (SELECT id FROM profiles);
DELETE FROM organization_members WHERE user_id NOT IN (SELECT id FROM profiles);
UPDATE tasks SET status = 'Done' WHERE is_completed = true AND (status = 'To-Do' OR status IS NULL);

-- 3. ESKİ POLİTİKALARI TEMİZLEME (HATA ALMAMAK İÇİN)
drop policy if exists "Tasks_Privacy" on tasks;
drop policy if exists "Tasks_Policy" on tasks;
drop policy if exists "Tasks_Final" on tasks;
drop policy if exists "Orgs_Privacy" on organizations;
drop policy if exists "Orgs_Select_Final" on organizations;
drop policy if exists "Orgs_Select_Fixed" on organizations;
drop policy if exists "Orgs_Insert_Final" on organizations;
drop policy if exists "Members_Privacy" on organization_members;
drop policy if exists "Members_Final" on organization_members;
drop policy if exists "Members_Fixed" on organization_members;
drop policy if exists "Members_Select" on organization_members;
drop policy if exists "Members_Modify" on organization_members;
drop policy if exists "Profiles_Privacy" on profiles;
drop policy if exists "Profiles_Final" on profiles;
drop policy if exists "Journals_Final" on journals;
drop policy if exists "Org_Messages_Policy" on org_messages;
drop policy if exists "Task_Comments_Select" on task_comments;
drop policy if exists "Task_Comments_Insert" on task_comments;
drop policy if exists "Task_Files_Select" on task_files;
drop policy if exists "Task_Files_Insert" on task_files;
drop policy if exists "Org_Resources_Policy" on org_resources;
drop policy if exists "Org_Meetings_Policy" on org_meetings;
drop policy if exists "Org_Polls_Policy" on org_polls;
drop policy if exists "Org_Poll_Options_Policy" on org_poll_options;
drop policy if exists "Org_Poll_Votes_Policy" on org_poll_votes;

-- STORAGE POLİTİKALARINI TEMİZLEME
drop policy if exists "Task Files Hepsi Bir Arada Yetkisi" on storage.objects;
drop policy if exists "Give users access to a folder only to authenticated users" on storage.objects;
drop policy if exists "Give users authenticated access to folder" on storage.objects;
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Public Insert" on storage.objects;
