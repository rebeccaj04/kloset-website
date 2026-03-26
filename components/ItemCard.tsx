import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KlosetItem } from '@/lib/supabase';

const STATUS_ICON: Record<string, { name: React.ComponentProps<typeof Ionicons>['name']; color: string; bg: string }> = {
  wearing:      { name: 'person',        color: '#FFFFFF', bg: '#C9A84C' },
  washing:      { name: 'water',         color: '#FFFFFF', bg: '#4A90C4' },
  dry_cleaning: { name: 'cut',           color: '#FFFFFF', bg: '#8B6BAE' },
};

type Props = {
  item: KlosetItem;
  onPress?: () => void;
  onToggleFavourite?: () => void;
};

const CONDITION_COLOUR: Record<string, string> = {
  new: '#2D7D46',
  good: '#8F8F8F',
  worn: '#B8860B',
  damaged: '#C0392B',
  stained: '#7B5EA7',
};

export default function ItemCard({ item, onPress, onToggleFavourite }: Props) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const conditionColour = CONDITION_COLOUR[item.condition] ?? '#8F8F8F';
  const hasUrl = !!item.image_url;
  const showImage = hasUrl && !imgError;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {/* Image container: explicit width + aspectRatio on the parent so it
          resolves before the child Image renders. This avoids the RN bug where
          width:'100%' + aspectRatio on an Image can collapse to 0 height when
          the flex layout hasn't resolved yet. */}
      <View style={styles.imageContainer}>
        {showImage ? (
          <Image
            source={{ uri: item.image_url! }}
            style={styles.image}
            resizeMode="cover"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="shirt-outline" size={40} color="#C8C4BC" />
            {!hasUrl && (
              <Text style={styles.placeholderText}>{item.type ?? 'Item'}</Text>
            )}
            {hasUrl && imgError && (
              <Text style={styles.placeholderText}>Image unavailable</Text>
            )}
          </View>
        )}
        {/* Status badge overlay — top-left, shown for any non-available status */}
        {item.status && item.status !== 'available' && STATUS_ICON[item.status] && (
          <View style={[styles.statusBadge, { backgroundColor: STATUS_ICON[item.status].bg }]}>
            <Ionicons name={STATUS_ICON[item.status].name} size={11} color={STATUS_ICON[item.status].color} />
          </View>
        )}
        {/* Damage/repair warning badge — bottom-left */}
        {(item.needs_repair === true || item.condition === 'stained' || item.condition === 'damaged') && (
          <View style={styles.warningBadge}>
            <Ionicons name="warning" size={11} color="#FFFFFF" />
          </View>
        )}
        {/* Favourite heart — top-right */}
        {onToggleFavourite && (
          <Pressable
            style={styles.heartBtn}
            onPress={e => { e.stopPropagation?.(); onToggleFavourite(); }}
            hitSlop={8}>
            <Ionicons
              name={item.is_favourite ? 'heart' : 'heart-outline'}
              size={18}
              color={item.is_favourite ? '#000000' : 'rgba(0,0,0,0.3)'}
            />
          </Pressable>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.type} numberOfLines={1}>
          {item.type ?? 'Item'}
        </Text>
        {item.colour && (
          <Text style={styles.colour} numberOfLines={1}>
            {item.colour}
          </Text>
        )}
        <View style={styles.meta}>
          {item.brand && (
            <Text style={styles.brand} numberOfLines={1}>
              {item.brand}
            </Text>
          )}
          <View style={[styles.conditionDot, { backgroundColor: conditionColour }]} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  // Wrapper View carries the aspect ratio so the Image inside always
  // has a concrete height — avoids the 0-height collapse bug.
  imageContainer: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#F4F3F1',
    position: 'relative',
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  heartBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    // Fill the resolved container absolutely
    ...StyleSheet.absoluteFillObject,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderText: {
    color: '#8F8F8F',
    fontSize: 11,
    textTransform: 'capitalize',
    fontFamily: 'Inter_400Regular',
  },
  info: {
    padding: 12,
  },
  type: {
    fontSize: 13,
    color: '#000000',
    textTransform: 'capitalize',
    fontFamily: 'Inter_600SemiBold',
  },
  colour: {
    fontSize: 12,
    color: '#8F8F8F',
    marginTop: 2,
    textTransform: 'capitalize',
    fontFamily: 'Inter_400Regular',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  brand: {
    fontSize: 11,
    color: '#8F8F8F',
    flex: 1,
    fontFamily: 'Inter_400Regular',
  },
  conditionDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  warningBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E8854F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
});
