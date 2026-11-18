from langchain_core.tools import tool
import adapters.operations_adapter as ops_adapter

@tool
def get_sites(city: str = None, status: str = None, site_type: str = None) -> dict:
    """
    Get a list of hoarding/advertising sites. Returns the count and details of each site.
    Optionally filter by 'city', 'status' (Active, Inactive), or 'site_type' (Highway, Mall, etc.).
    """
    return ops_adapter.get_sites(city, status, site_type)

@tool
def get_bookings(site_id: str = None, campaign_id: str = None) -> dict:
    """
    Get a list of site bookings. Returns the count and details of each booking.
    Optionally filter by 'site_id' or 'campaign_id'.
    """
    return ops_adapter.get_bookings(site_id, campaign_id)

@tool
def get_vendors(name: str = None, city: str = None, status: str = None) -> dict:
    """
    Get a list of vendors. Returns the count and details of each vendor.
    Optionally filter by 'name', 'city', or 'status' (Active, Inactive).
    """
    return ops_adapter.get_vendors(name, city, status)

@tool
def get_campaigns(name: str = None, city: str = None, status: str = None) -> dict:
    """
    Get a list of marketing campaigns. Returns the count and details of each campaign.
    Optionally filter by 'name', 'city', or 'status' (Active, Completed, Cancelled).
    """
    return ops_adapter.get_campaigns(name, city, status)

@tool
def book_site(site_code: str, start_date: str, end_date: str = None, campaign_name: str = None) -> dict:
    """
    Book an outdoor advertising site/hoarding for a specific date range (YYYY-MM-DD).
    Strictly checks and blocks double-booking if the site has any overlapping reservations.
    - site_code: The site code (e.g. 'IND-HIGHWAY-001', 'BHO-MALL-001') or site ID.
    - start_date: Booking start date in YYYY-MM-DD format (e.g. '2026-11-01').
    - end_date: Optional booking end date in YYYY-MM-DD format (defaults to start_date if single day).
    - campaign_name: Optional name or ID of the campaign to book under.
    """
    return ops_adapter.book_site(site_code, start_date, end_date, campaign_name)

