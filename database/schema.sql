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