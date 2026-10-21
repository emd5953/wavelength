import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { getMyAnonId } from '../src/services/presence';
import DMScreen from '../src/components/DMScreen';

export default function DMRoute() {
  const { recipientAnonId } = useLocalSearchParams<{ recipientAnonId: string }>();
  const [myAnonId, setMyAnonId] = useState('');

  useEffect(() => {
    getMyAnonId().then((id) => {
      if (id) setMyAnonId(id);
    });
  }, []);

  if (!recipientAnonId || !myAnonId) return null;

  return <DMScreen recipientAnonId={recipientAnonId} />;
}
