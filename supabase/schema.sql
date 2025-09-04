-- Create projects table
create table if not exists projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  name text not null,
  canvas_state jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create a trigger to update the updated_at column
create or replace function update_updated_at_column()
returns trigger as $$
begin
   NEW.updated_at = now();
   return NEW;
end;
$$ language 'plpgsql';

create trigger update_projects_updated_at before update
  on projects for each row
  execute procedure update_updated_at_column();

-- Enable Row Level Security (RLS)
alter table projects enable row level security;

-- Create policies for RLS
create policy "Users can view their own projects" on projects
  for select using (auth.uid() = user_id);

create policy "Users can insert their own projects" on projects
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own projects" on projects
  for update using (auth.uid() = user_id);

create policy "Users can delete their own projects" on projects
  for delete using (auth.uid() = user_id);

-- Create storage bucket for images (if needed)
insert into storage.buckets (id, name, public)
  values ('images', 'images', true)
  on conflict (id) do nothing;

-- Create policies for image storage
create policy "Users can upload images" on storage.objects
  for insert with check (bucket_id = 'images' and auth.role() = 'authenticated');

create policy "Users can view their own images" on storage.objects
  for select using (bucket_id = 'images' and auth.uid() = owner);

create policy "Users can update their own images" on storage.objects
  for update using (bucket_id = 'images' and auth.uid() = owner);

create policy "Users can delete their own images" on storage.objects
  for delete using (bucket_id = 'images' and auth.uid() = owner);