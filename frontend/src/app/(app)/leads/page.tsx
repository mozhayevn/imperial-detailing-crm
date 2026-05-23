import { ModulePlaceholder } from "@/src/components/layout/module-placeholder";

export default function LeadsPage() {
  return (
    <ModulePlaceholder
      eyebrow="Заявки"
      title="Будущие входящие заявки"
      description="Архитектурное место для заявок из Telegram, WhatsApp, Instagram Direct, сайта, ручного источника и bot source."
      status="future"
      primaryAction="Запланировать позже"
      secondaryAction="Оставить как future module"
      points={[
        "Source badges для Telegram, WhatsApp, Instagram, website, manual и bot.",
        "Inbound requests queue для менеджера.",
        "Конвертация заявки в клиента, автомобиль и заказ.",
        "Будущая интеграция с chatbot workflows.",
      ]}
    />
  );
}