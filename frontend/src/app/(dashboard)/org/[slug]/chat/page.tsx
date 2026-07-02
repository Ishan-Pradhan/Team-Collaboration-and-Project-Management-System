import ChatPage from './_components/ChatPage';

interface Props {
  params: Promise<{ slug: string }>;
}

export default function Page({ params }: Props) {
  return <ChatPage params={params} />;
}
