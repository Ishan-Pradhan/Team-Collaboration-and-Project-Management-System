import CalendarPage from './_components/CalendarPage';

interface Props {
  params: Promise<{ slug: string }>;
}

export default function CalendarRoute({ params }: Props) {
  return <CalendarPage params={params} />;
}
