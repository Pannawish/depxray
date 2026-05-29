import React from 'react';
import type { FooterProps } from '../types';

export function Footer({ date }: FooterProps) {
  return <footer>© {date}</footer>;
}
