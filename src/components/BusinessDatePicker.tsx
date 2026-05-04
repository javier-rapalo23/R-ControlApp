import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  dates: string[];
  value: string;
  onChange: (businessDate: string) => void;
};

function BusinessDatePicker({ dates, value, onChange }: Props): React.JSX.Element | null {
  if (dates.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {dates.map(date => {
        const isActive = date === value;

        return (
          <TouchableOpacity
            key={date}
            style={[styles.chip, isActive && styles.chipActive]}
            onPress={() => onChange(date)}>
            <Text style={[styles.text, isActive && styles.textActive]}>{date}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
  },
  chipActive: {
    backgroundColor: '#0B5FFF',
    borderColor: '#0B5FFF',
  },
  text: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '700',
  },
  textActive: {
    color: '#FFFFFF',
  },
});

export default BusinessDatePicker;