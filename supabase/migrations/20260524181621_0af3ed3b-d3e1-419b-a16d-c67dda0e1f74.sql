ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS debe_completar_onboarding boolean NOT NULL DEFAULT false;