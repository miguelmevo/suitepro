
-- Crear trigger para que cuando se cree un usuario en auth.users, 
-- automáticamente se cree su perfil en public.profiles
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();
