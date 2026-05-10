import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mtkusbnrvxbxhdncmfiv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10a3VzYm5ydnhieGhkbmNtZml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NzkyNTMsImV4cCI6MjA5MjI1NTI1M30.adpq9ihtPXd3gMx35r10Jk0fLS7geWcmhkIwcCpeK7E';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);