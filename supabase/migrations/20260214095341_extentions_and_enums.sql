-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Enums
create type purchase_source as enum ('email', 'ocr', 'manual');
create type swipe_outcome as enum ('satisfied', 'regret', 'not_sure');
create type swipe_timing as enum ('immediate', 'day3', 'week3', 'month3');
create type user_value_type as enum (
  'durability',
  'efficiency',
  'aesthetics',
  'interpersonal_value',
  'emotional_value'
);
create type purchaseCategory as enum ('electronics', 'fashion', 'home goods', 'health & wellness', 'travel', 'entertainment', 'subscriptions', 'food & beverage', 'services', 'education', 'other');
create type ocr_status as enum ('pending', 'processing', 'completed', 'failed');
create type verdict_outcome as enum ('bought', 'hold', 'skip');
create type vendorQuality as enum ('low', 'medium', 'high');
create type vendorReliability as enum ('low', 'medium', 'high');
create type vendorPriceTier as enum ('budget', 'mid_range', 'premium', 'luxury');
create type purchaseStatsDimensionType as enum ('category', 'price_range', 'vendor', 'vendor_quality', 'vendor_reliability', 'vendor_price_tier');
create type email_connection_provider as enum ('gmail', 'outlook', 'other');

