import { ReactNode } from 'react';
import { View, Pressable } from 'react-native';

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  className?: string;
  padding?: boolean;
}

export default function Card({ children, onPress, className = '', padding = true }: CardProps) {
  const baseClasses = `bg-bg-card border border-bg-border rounded-2xl ${padding ? 'p-4' : ''} ${className}`;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        className={baseClasses}
      >
        {children}
      </Pressable>
    );
  }

  return <View className={baseClasses}>{children}</View>;
}
