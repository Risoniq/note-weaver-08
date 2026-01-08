-- Enum für Rollen
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- User Roles Tabelle
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);

-- RLS aktivieren
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security Definer Funktion (verhindert RLS-Rekursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policy: Nur Admins können Rollen sehen
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin-Rolle für dominik@risoniq.ai einfügen (user_id: 704551d2-286b-4e57-80d0-721f198aea43)
INSERT INTO public.user_roles (user_id, role)
VALUES ('704551d2-286b-4e57-80d0-721f198aea43', 'admin');