import { ModulePlaceholder } from "@/src/components/layout/module-placeholder";

export default function AiPage() {
  return (
    <ModulePlaceholder
      eyebrow="AI-ассистент"
      title="Будущий AI-слой CRM"
      description="Место для AI summary, pricing suggestions, upsell recommendations и assistant panel для менеджера."
      status="future"
      primaryAction="Запланировать позже"
      secondaryAction="Оставить как future module"
      points={[
        "AI summary по клиенту и истории обращений.",
        "AI summary по заказу и составу услуг.",
        "AI pricing suggestions на основе backend pricing engine.",
        "AI recommendations по upsell и предпочтениям клиента.",
        "Assistant panel для менеджера.",
      ]}
    />
  );
}