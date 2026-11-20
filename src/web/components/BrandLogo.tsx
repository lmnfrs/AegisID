import LogoLight from '../assets/LogoLight.png';
import LogoDark from '../assets/LogoDark.png';
import { useTheme } from '../context/ThemeContext';

interface BrandLogoProps {
  height?: number;
}

export default function BrandLogo({ height = 36 }: BrandLogoProps) {
  const { isDark } = useTheme();

  return (
    <img
      src={isDark ? LogoDark : LogoLight}
      alt="AegisID Logo"
      style={{ height: `${height}px`, objectFit: 'contain', display: 'inline-block' }}
    />
  );
}