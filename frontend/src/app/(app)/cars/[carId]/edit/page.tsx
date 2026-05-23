import { CarEditPageClient } from "@/src/features/cars/car-edit-page-client";

type CarEditPageProps = {
  params: Promise<{
    carId: string;
  }>;
};

export default async function CarEditPage({ params }: CarEditPageProps) {
  const { carId } = await params;

  return <CarEditPageClient carId={Number(carId)} />;
}