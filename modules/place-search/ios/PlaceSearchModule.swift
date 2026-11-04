import ExpoModulesCore
import MapKit

/// The part of the map the user is looking at; results nearby come first.
struct SearchRegion: Record {
  @Field var latitude: Double = 0
  @Field var longitude: Double = 0
  @Field var latitudeDelta: Double = 0
  @Field var longitudeDelta: Double = 0
}

/// Searches places (shops, sights, addresses) with Apple Maps. Free and needs no API key
/// or location permission, but does need a network connection.
public class PlaceSearchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PlaceSearch")

    AsyncFunction("searchAsync") { (query: String, near: SearchRegion?) in
      return try await search(query: query, near: near)
    }
  }
}

private func search(query: String, near: SearchRegion?) async throws -> [[String: Any?]] {
  let request = MKLocalSearch.Request()
  request.naturalLanguageQuery = query
  if let near {
    request.region = MKCoordinateRegion(
      center: CLLocationCoordinate2D(latitude: near.latitude, longitude: near.longitude),
      span: MKCoordinateSpan(latitudeDelta: near.latitudeDelta, longitudeDelta: near.longitudeDelta)
    )
  }
  do {
    let response = try await MKLocalSearch(request: request).start()
    return response.mapItems.map(describe)
  } catch let error as MKError where error.code == .placemarkNotFound {
    // Nothing matched: that is an empty list, not a failure
    return []
  }
}

private func describe(_ item: MKMapItem) -> [String: Any?] {
  let coordinate: CLLocationCoordinate2D
  let address: String?
  if #available(iOS 26.0, *) {
    coordinate = item.location.coordinate
    address = item.address?.shortAddress ?? item.address?.fullAddress
  } else {
    coordinate = item.placemark.coordinate
    address = item.placemark.title
  }
  return [
    "name": item.name,
    "address": address,
    "latitude": coordinate.latitude,
    "longitude": coordinate.longitude,
  ]
}
