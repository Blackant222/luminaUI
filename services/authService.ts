import { createClient } from '@supabase/supabase-js';
import { Session } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  // @ts-ignore
  import.meta.env.VITE_SUPABASE_URL,
  // @ts-ignore
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// User type
export type User = {
  id: string;
  email: string;
  created_at: string;
};

// Auth state type
export type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
};

// Sign up function
export const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
};

// Sign in function
export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
};

// Sign out function
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// Get current user
export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
};

// Listen for auth state changes
export const onAuthStateChange = (callback: (event: string, session: Session | null) => void) => {
  const { data } = supabase.auth.onAuthStateChange(callback);
  return data.subscription;
};

export default supabase;