import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { COLOR_THEMES } from "@/lib/congregation-colors";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ColorSelectorProps {
  value: string;
  onChange: (colorId: string) => void;
  label?: string;
}

export function ColorSelector({ value, onChange, label = "Color del tema" }: ColorSelectorProps) {
  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        <TooltipProvider>
          {COLOR_THEMES.map((color) => (
            <Tooltip key={color.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onChange(color.id)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-all duration-200 flex items-center justify-center border-2",
                    value === color.id
                      ? "ring-2 ring-offset-2 ring-offset-background scale-110"
                      : "border-transparent hover:scale-105"
                  )}
                  style={{
                    backgroundColor: color.preview,
                    borderColor: value === color.id ? color.preview : "transparent",
                    boxShadow: value === color.id ? `0 0 0 2px ${color.preview}40` : "none",
                  }}
                >
                  {value === color.id && (
                    <Check className="h-4 w-4 text-white drop-shadow-sm" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{color.name}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>
    </div>
  );
}
