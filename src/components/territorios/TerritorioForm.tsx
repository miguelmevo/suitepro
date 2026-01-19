import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Upload, X, Loader2, LayoutGrid } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useGruposPredicacion } from "@/hooks/useGruposPredicacion";
import { useCongregacionId } from "@/contexts/CongregacionContext";

const LETRAS_DISPONIBLES = Array.from({ length: 16 }, (_, i) =>
  String.fromCharCode(65 + i)
); // A-P (16 letras)

interface TerritorioFormData {
  numero: string;
  nombre: string;
  url_maps: string;
  imagen_url: string;
  grupo_predicacion_id: string;
  manzanas: string[];
}

interface TerritorioFormProps {
  initialData?: TerritorioFormData;
  onSubmit: (data: TerritorioFormData) => Promise<void>;
  onCancel: () => void;
  isEditing?: boolean;
  existingNumeros: string[];
}

export function TerritorioForm({ initialData, onSubmit, onCancel, isEditing, existingNumeros }: TerritorioFormProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [numeroError, setNumeroError] = useState<string | null>(null);
  const [formData, setFormData] = useState<TerritorioFormData>(
    initialData || { numero: "", nombre: "", url_maps: "", imagen_url: "", grupo_predicacion_id: "", manzanas: [] }
  );

  const congregacionId = useCongregacionId();
  const { grupos: gruposPredicacion, isLoading: loadingGrupos } = useGruposPredicacion();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Tipo de archivo no permitido", description: "Solo JPG, PNG, WebP o GIF", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Archivo muy grande", description: "Máximo 5MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop()?.toLowerCase() || 'png';
      const territorioNumero = formData.numero.trim() || 'SIN_NUMERO';
      const fileName = `${congregacionId}_TERR${territorioNumero}.${fileExt}`;
      const filePath = `imagenes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("territorios")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("territorios").getPublicUrl(filePath);
      setFormData({ ...formData, imagen_url: urlData.publicUrl });
      toast({ title: "Imagen subida correctamente" });
    } catch (error: any) {
      toast({ title: "Error al subir imagen", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setFormData({ ...formData, imagen_url: "" });
  };

  const validateNumero = (numero: string): boolean => {
    const trimmed = numero.trim();
    if (!trimmed) {
      setNumeroError("El número es requerido");
      return false;
    }
    const isDuplicate = existingNumeros.some(
      (n) => n === trimmed && (!isEditing || n !== initialData?.numero)
    );
    if (isDuplicate) {
      setNumeroError("Este número de territorio ya existe");
      return false;
    }
    setNumeroError(null);
    return true;
  };

  const handleNumeroChange = (value: string) => {
    setFormData({ ...formData, numero: value });
    if (numeroError) validateNumero(value);
  };

  const handleToggleManzana = (letra: string) => {
    const isSelected = formData.manzanas.includes(letra);
    if (isSelected) {
      setFormData({ ...formData, manzanas: formData.manzanas.filter((l) => l !== letra) });
    } else {
      setFormData({ ...formData, manzanas: [...formData.manzanas, letra].sort() });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateNumero(formData.numero)) return;
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="numero">Número *</Label>
          <Input
            id="numero"
            value={formData.numero}
            onChange={(e) => handleNumeroChange(e.target.value)}
            onBlur={() => validateNumero(formData.numero)}
            required
            placeholder="Ej: 1, 2, 3..."
            className={numeroError ? "border-destructive" : ""}
          />
          {numeroError && (
            <p className="text-sm text-destructive">{numeroError}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="nombre">Nombre</Label>
          <Input
            id="nombre"
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            placeholder="Ej: Centro, Norte..."
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="grupo_predicacion_id">Grupo Asignado</Label>
        <Select 
          value={formData.grupo_predicacion_id} 
          onValueChange={(value) => setFormData({ ...formData, grupo_predicacion_id: value === "none" ? "" : value })}
        >
          <SelectTrigger>
            <SelectValue placeholder={loadingGrupos ? "Cargando..." : "Seleccionar grupo..."} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin asignar</SelectItem>
            {gruposPredicacion?.map((grupo) => (
              <SelectItem key={grupo.id} value={grupo.id}>
                G{grupo.numero}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Asigna este territorio a un grupo de predicación (G1, G2, etc.)
        </p>
      </div>

      {/* Selector de Manzanas */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" />
          Manzanas del territorio
        </Label>
        <div className="rounded-lg border bg-muted/30 p-1.5">
          <div className="grid grid-cols-8 gap-0.5">
            {LETRAS_DISPONIBLES.map((letra) => {
              const isSelected = formData.manzanas.includes(letra);
              return (
                <label
                  key={letra}
                  className={`flex items-center justify-center w-7 h-6 rounded border cursor-pointer transition-colors text-[11px] font-medium ${
                    isSelected 
                      ? "bg-primary text-primary-foreground border-primary" 
                      : "bg-background hover:bg-accent border-input"
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleToggleManzana(letra)}
                    className="sr-only"
                  />
                  {letra}
                </label>
              );
            })}
          </div>
          {formData.manzanas.length > 0 && (
            <div className="mt-3 pt-3 border-t flex flex-wrap gap-1.5">
              <span className="text-xs text-muted-foreground mr-1">Seleccionadas:</span>
              {formData.manzanas.map((letra) => (
                <Badge key={letra} variant="secondary" className="px-2 py-0.5 text-xs">
                  {letra}
                </Badge>
              ))}
            </div>
          )}
          {formData.manzanas.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Selecciona las letras de las manzanas que componen este territorio
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="url_maps">Link de Google Maps</Label>
        <Input
          id="url_maps"
          type="url"
          value={formData.url_maps}
          onChange={(e) => setFormData({ ...formData, url_maps: e.target.value })}
          placeholder="https://maps.google.com/..."
        />
      </div>

      <div className="space-y-2">
        <Label>Imagen del territorio</Label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleImageUpload}
        />
        {formData.imagen_url ? (
          <div className="space-y-2">
            <div className="relative inline-block">
              <img
                src={`${formData.imagen_url}?t=${Date.now()}`}
                alt="Territorio"
                className="h-32 w-auto rounded-lg border object-cover"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -right-2 -top-2 h-6 w-6"
                onClick={handleRemoveImage}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Cambiar imagen
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Subir imagen
            </Button>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={uploading}>
          {isEditing ? "Actualizar" : "Crear"}
        </Button>
      </div>
    </form>
  );
}
