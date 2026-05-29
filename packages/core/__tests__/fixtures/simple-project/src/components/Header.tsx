import React from 'react';
import type { HeaderProps } from '../types';
import { cn } from '@utils/helpers';

export function Header({ title }: HeaderProps) {
  return <header className={cn('header')}>{title}</header>;
}
