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

const marks: Record<TabKey, string> = {
  home: '01',
  map: '04',
  stations: '02',
  owner: '03',
};

export function BottomTabs({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <View style={styles.wrap}>
      {(['home', 'stations', 'owner', 'map'] as TabKey[]).map((tab) => {
        const selected = active === tab;
        return (
          <Pressable key={tab} style={[styles.item, selected && styles.activeItem]} onPress={() => onChange(tab)}>
            <Text style={[styles.mark, selected && styles.activeMark]}>{marks[tab]}</Text>
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
    minHeight: 58,
    paddingVertical: 8,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeItem: {
    backgroundColor: '#0c447c',
  },
  mark: {
    fontSize: 10,
    color: '#9db0c4',
    fontWeight: '900',
    marginBottom: 2,
  },
  activeMark: {
    color: 'rgba(255,255,255,0.7)',
  },
  label: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: '800',
    textAlign: 'center',
  },
  activeLabel: {
    color: palette.white,
  },
});
