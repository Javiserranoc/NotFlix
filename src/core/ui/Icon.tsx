import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

type Props = Omit<ComponentProps<typeof MaterialCommunityIcons>, 'name'> & { name: string };

/** Icono por nombre (string) para que los módulos no dependan de tipos del paquete. */
export function Icon({ name, ...rest }: Props) {
  return <MaterialCommunityIcons name={name as keyof typeof MaterialCommunityIcons.glyphMap} {...rest} />;
}
