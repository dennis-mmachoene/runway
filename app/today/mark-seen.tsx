'use client';

import * as React from 'react';
import { markSeen } from '@/lib/diff/actions';

/**
 * Stamps "last seen" after the gauge has rendered, so the next visit can diff
 * against this one. Renders nothing.
 */
export function MarkSeen() {
  React.useEffect(() => {
    void markSeen();
  }, []);
  return null;
}
