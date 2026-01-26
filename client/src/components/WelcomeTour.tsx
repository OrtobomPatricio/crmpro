import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  CheckCircle2, 
  LayoutGrid, 
  Zap, 
  Activity, 
  Keyboard,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

interface TourStep {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
}

const tourSteps: TourStep[] = [
  {
    id: 1,
    title: "Bienvenido al CRM de WhatsApp",
    description: "Este sistema te permite gestionar miles de leads, enviar campañas masivas y monitorear conversaciones en tiempo real con múltiples números de WhatsApp distribuidos en varios países.",
    icon: CheckCircle2,
  },
  {
    id: 2,
    title: "Tablero Kanban",
    description: "Arrastra y suelta leads entre columnas para actualizar su estado. Cada lead muestra su comisión potencial (Panamá: 10,000 G$, otros países: 5,000 G$).",
    icon: LayoutGrid,
  },
  {
    id: 3,
    title: "Sistema de Warm-up",
    description: "Los números nuevos pasan por un período de calentamiento de 28 días, aumentando gradualmente de 20 a 1,000 mensajes/día para evitar bloqueos.",
    icon: Zap,
  },
  {
    id: 4,
    title: "Monitoreo en Vivo",
    description: "Visualiza el estado de todos tus números de WhatsApp en tiempo real, incluyendo conexión, progreso de warm-up, mensajes enviados y alertas de bloqueo.",
    icon: Activity,
  },
  {
    id: 5,
    title: "Atajos de Teclado",
    description: "Navega más rápido con atajos: Ctrl+H (Home), Ctrl+L (Leads), Ctrl+B (Kanban), Ctrl+A (Analytics), Ctrl+M (Monitoreo). Haz clic en el ícono de teclado en el header para ver todos.",
    icon: Keyboard,
  },
];

interface WelcomeTourProps {
  onComplete: () => void;
}

export default function WelcomeTour({ onComplete }: WelcomeTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const { user } = useAuth();
  
  const markTourSeen = trpc.auth.markTourSeen.useMutation({
    onSuccess: () => {
      onComplete();
    },
  });

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    markTourSeen.mutate();
    setIsVisible(false);
  };

  const handleSkip = () => {
    markTourSeen.mutate();
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const step = tourSteps[currentStep];
  const StepIcon = step.icon;
  const isLastStep = currentStep === tourSteps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-lg mx-4 shadow-2xl">
        <CardHeader className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
            onClick={handleSkip}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <StepIcon className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl">{step.title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <CardDescription className="text-base leading-relaxed">
            {step.description}
          </CardDescription>

          {/* Progress Indicator */}
          <div className="flex items-center justify-center gap-2">
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all ${
                  index === currentStep
                    ? "w-8 bg-primary"
                    : index < currentStep
                    ? "w-2 bg-primary/60"
                    : "w-2 bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="text-muted-foreground"
            >
              Saltar Tour
            </Button>
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <Button variant="outline" onClick={handlePrevious}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
              )}
              {isLastStep ? (
                <Button onClick={handleComplete}>
                  Comenzar
                </Button>
              ) : (
                <Button onClick={handleNext}>
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
