import { useEffect, useState } from 'react';
import { useNavigation } from 'expo-router';

/**
 * Ekran geçiş animasyonu bitene kadar `false` döner.
 * Ağır bileşenleri (uzun listeler, GiftedChat vb.) animasyon sırasında mount etmek
 * yerine geçiş bittikten sonra render ederek dokunma → animasyon gecikmesini önler.
 *
 * `transitionEnd` olayı gelmezse (ör. animasyonsuz açılış) `fallbackMs` sonra hazır olur.
 */
export function useTransitionReady(fallbackMs = 300): boolean {
  const navigation = useNavigation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setReady(true);
    };

    // native-stack 'transitionEnd' olayı yayınlar
    const unsubscribe = navigation.addListener('transitionEnd' as any, finish);
    const timer = setTimeout(finish, fallbackMs);

    return () => {
      done = true;
      clearTimeout(timer);
      unsubscribe?.();
    };
  }, [navigation, fallbackMs]);

  return ready;
}
