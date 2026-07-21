-- Fix: the original seed statement in migration
-- 20260719165646_packages_discounts_favorites_reviews_complaints_payments_delivery
-- targeted WHERE "name" = 'Hall', but ServicesService.createServiceType always
-- uppercases names on creation (`name: dto.name.toUpperCase()`), so the real
-- row is 'HALL'. Verified live: the original UPDATE matched zero rows.
UPDATE "ServiceType" SET "isVenue" = true, "requiresDeliveryByDefault" = false WHERE "name" = 'HALL';