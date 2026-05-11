import React from 'react';
import {
  LayoutDashboard, Users, Newspaper, ClipboardList, Package,
  AlertTriangle, Bike, Settings, ScrollText, Check, Key,
  FileText, PenSquare, ShoppingCart, Store, Tag, Trash2,
  Phone, Star, Circle,
} from 'lucide-react';

const ICON_MAP = {
  LayoutDashboard, Users, Newspaper, ClipboardList, Package,
  AlertTriangle, Bike, Settings, ScrollText, Check, Key,
  FileText, PenSquare, ShoppingCart, Store, Tag, Trash2,
  Phone, Star,
};

export const Icon = React.memo(({ name, size = 20, ...props }) => {
  const LucideIcon = ICON_MAP[name];
  if (!LucideIcon) {
    return <Circle size={size} aria-hidden="true" {...props} />;
  }
  return <LucideIcon size={size} aria-hidden="true" {...props} />;
});

Icon.displayName = 'Icon';
