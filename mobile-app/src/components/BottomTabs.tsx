import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { palette } from '../theme';

type TabKey = 'home' | 'map' | 'stations' | 'owner';

const labels: Record<TabKey, string> = {
  home: 'الرئيسية',
  map: 'الخريطة',
  stations: 'المحطات',
  owner: 'بوابة المحطة',
};

export function BottomTabs({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <View style={styles.wrap}>
      {(['home', 'map', 'stations', 'owner'] as TabKey[]).map((tab) => {
        const selected = active === tab;
        return (
          <Pressable key={tab} style={[styles.item, selected && styles.activeItem]} onPress={() => onChange(tab)}>
            <Text style={[styles.label, selected && styles.activeLabel]}>{labels[tab]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row-reverse',
    backgroundColor: palette.white,
    borderTopWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  item: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  activeItem: {
    backgroundColor: '#e8f2fb',
  },
  label: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: '600',
  },
  activeLabel: {
    color: palette.deepBlue,
  },
});
