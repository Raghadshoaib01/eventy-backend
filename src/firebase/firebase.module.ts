// src/firebase/firebase.module.ts

import { Global, Module } from '@nestjs/common';
import { FirebaseService } from './firebase.service';

/**
 * FirebaseModule — globally available.
 * Provides and exports FirebaseService so any feature module can inject it
 * without re-importing.
 */
@Global()
@Module({
  providers: [FirebaseService],
  exports: [FirebaseService],
})
export class FirebaseModule {}
