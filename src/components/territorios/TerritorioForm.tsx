import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TerritorioFormData {
  numero: string;
  nombre: string;
  descripcion: string;
  url_maps: string;
  imagen_url: string;
}

interface TerritorioFormProps {
  initialData?: TerritorioFormData;
  onSubmit: (data: TerritorioFormData) => Promise<void>;
  onCancel: () => void;
  isEditing?: boolean;
}

export function TerritorioForm({ initialData, onSubmit, onCancel, isEditing }: TerritorioFormProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState<TerritorioFormData>(
    initialData || { numero: "", nombre: "", descripcion: "", url_maps: "", imagen_url: "" }
  );

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
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `imagenes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("territorios")
        .upload(filePath, file);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
            onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
            required
            placeholder="Ej: 01, 02, A1..."
          />
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
        <Label htmlFor="descripcion">Descripción</Label>
        <Textarea
          id="descripcion"
          value={formData.descripcion}
          onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
          placeholder="Límites o detalles del territorio..."
        />
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
        {formData.imagen_url ? (
          <div className="relative inline-block">
            <img
              src={formData.imagen_url}
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
        ) : (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleImageUpload}
            />
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
