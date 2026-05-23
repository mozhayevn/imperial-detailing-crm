import { CarDetailsPageClient } from "@/src/features/cars/car-details-page-client";

type CarDetailsPageProps = {
  params: Promise<{
    carId: string;
  }>;
};

export default async function CarDetailsPage({ params }: CarDetailsPageProps) {
  const { carId } = await params;

  return <CarDetailsPageClient carId={Number(carId)} />;
}