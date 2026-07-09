
-- Revert: evitar triggers sobre esquemas reservados (auth)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
