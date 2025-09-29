import type { Metadata } from 'next';
import './print.css';

export const metadata: Metadata = {
  title: 'Auction Preview',
};

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
