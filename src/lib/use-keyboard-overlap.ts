import { type RefObject, useEffect, useState } from 'react';
import { Dimensions, Keyboard, type KeyboardEvent, LayoutAnimation, Platform, type View } from 'react-native';

/**
 * Klavyenin verilen görünümün altını ne kadar kapattığını döndürür.
 * KeyboardAvoidingView, ekranın üstünden aşağıda başlayan iOS modal sayfalarında
 * yanlış hesaplıyor. iOS'ta ekranların (modal sayfalar dahil) alt kenarı ekranın
 * altına denk geldiği için örtüşme klavyenin ekrandaki yüksekliğidir; Android'de
 * pencere klavyeye göre küçülebildiği için görünüm ölçülür.
 */
export function useKeyboardOverlap(ref: RefObject<View | null>): number {
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    const animate = (e?: KeyboardEvent) => {
      if (Platform.OS === 'ios' && e?.duration) {
        LayoutAnimation.configureNext({
          duration: e.duration,
          update: { type: LayoutAnimation.Types.keyboard },
        });
      }
    };

    const onShow = (e: KeyboardEvent) => {
      const keyboardTop = e.endCoordinates.screenY;
      if (Platform.OS === 'ios') {
        animate(e);
        setOverlap(Math.max(0, Math.round(Dimensions.get('screen').height - keyboardTop)));
        return;
      }
      ref.current?.measureInWindow((_x, y, _w, h) => {
        setOverlap(Math.max(0, Math.round(y + h - keyboardTop)));
      });
    };
    const onHide = (e: KeyboardEvent) => {
      animate(e);
      setOverlap(0);
    };

    const subs =
      Platform.OS === 'ios'
        ? [Keyboard.addListener('keyboardWillShow', onShow), Keyboard.addListener('keyboardWillHide', onHide)]
        : [Keyboard.addListener('keyboardDidShow', onShow), Keyboard.addListener('keyboardDidHide', onHide)];
    return () => subs.forEach((s) => s.remove());
  }, [ref]);

  return overlap;
}
