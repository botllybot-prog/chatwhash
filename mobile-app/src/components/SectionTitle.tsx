import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette } from '../theme';

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: palette.muted,
    textAlign: 'right',
  },
});
