// Shared seed context types for downstream seeds (notifications, etc.)

export interface SeededEventsContext {
  bookingIds: {
    ahmadWeddingHall: string;
    dinaEngagementHall: string;
    dinaEngagementDecoration: string;
    ahmadBirthdayFood: string;
    ahmadBirthdayPhoto: string;
  };
}

export interface SeededProviderEntityRef {
  providerId: string;
  providerUserId: string;
  businessName: string;
}

export interface SeededServiceEntityRef extends SeededProviderEntityRef {
  serviceId: string;
  serviceType: string;
}

export interface SeededProvidersContext {
  khalidRoyalEvents: SeededProviderEntityRef;
  anasFoodService: SeededServiceEntityRef;
  beatmasterAudio: SeededProviderEntityRef;
}

export interface SeedNotificationContext {
  events: SeededEventsContext;
  providers: SeededProvidersContext;
}
