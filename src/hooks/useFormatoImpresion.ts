import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { FormatoImpresion } from "@/components/programa/ImpresionProgramaWrapper";

export function useFormatoImpresion(): FormatoImpresion {
  const { configuraciones } = useConfiguracionSistema("predicacion");
  const formatoConfig = configuraciones?.find(
    (c) => c.programa_tipo === "predicacion" && c.clave === "formato_impresion"
  );
  return (formatoConfig?.valor?.formato as FormatoImpresion) || "tabla";
}
