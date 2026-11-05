import { requireOptionalNativeModule } from "expo";

/** One result from Apple Maps; name or address can be missing */
export interface NativePlace {
  readonly name: string | null;
  readonly address: string | null;
  readonly latitude: number;
  readonly longitude: number;
}

/** The part of the map the user is looking at; results nearby come first */
export interface NativeSearchRegion {
  readonly latitude: number;
  readonly longitude: number;
  readonly latitudeDelta: number;
  readonly longitudeDelta: number;
}

interface PlaceSearchModule {
  /** Throws when offline or Apple Maps fails; no match resolves to [] */
  searchAsync(
    query: string,
    near: NativeSearchRegion | null,
  ): Promise<NativePlace[]>;
}

/** iOS only: null on Android, web and in tests */
export const placeSearchModule =
  requireOptionalNativeModule<PlaceSearchModule>("PlaceSearch");
