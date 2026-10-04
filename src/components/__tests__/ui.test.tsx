import { render, screen } from '@testing-library/react-native';

import { Txt, upperTr } from '../ui';

describe('upperTr', () => {
  it('Türkçe i/ı harflerini doğru büyütür', () => {
    expect(upperTr('Sigarayı bırak')).toBe('SİGARAYI BIRAK');
    expect(upperTr('Ya da birini seç')).toBe('YA DA BİRİNİ SEÇ');
    expect(upperTr('ığüşöç')).toBe('IĞÜŞÖÇ');
  });

  it('overline metnini büyük harfle yazar', () => {
    render(<Txt variant="overline">Son halkalar</Txt>);
    expect(screen.getByText('SON HALKALAR')).toBeTruthy();
  });
});
