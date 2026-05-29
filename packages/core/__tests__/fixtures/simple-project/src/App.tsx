import React from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { formatDate } from '@utils/helpers';
import type { AppProps } from './types';

// Dynamic import
const LazyDashboard = React.lazy(() => import('./pages/Dashboard'));

export default function App({ title }: AppProps) {
  return (
    <div>
      <Header title={title} />
      <LazyDashboard />
      <Footer date={formatDate(new Date())} />
    </div>
  );
}
