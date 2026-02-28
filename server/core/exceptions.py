"""
Custom exceptions for FINDER_ND server
"""


class FinderNDException(Exception):
    """Base exception for FINDER_ND system"""
    def __init__(self, message, status_code=500, payload=None):
        super().__init__()
        self.message = message
        self.status_code = status_code
        self.payload = payload

    def to_dict(self):
        rv = dict(self.payload or ())
        rv['error'] = self.message
        rv['success'] = False
        return rv


class GraphProcessingError(FinderNDException):
    """Exception raised for graph processing errors"""
    def __init__(self, message, status_code=400, payload=None):
        super().__init__(message, status_code, payload)


class ModelLoadError(FinderNDException):
    """Exception raised when model loading fails"""
    def __init__(self, message, status_code=500, payload=None):
        super().__init__(message, status_code, payload)


class DismantlingError(FinderNDException):
    """Exception raised during dismantling process"""
    def __init__(self, message, status_code=500, payload=None):
        super().__init__(message, status_code, payload)


class ValidationError(FinderNDException):
    """Exception raised for validation errors"""
    def __init__(self, message, status_code=400, payload=None):
        super().__init__(message, status_code, payload)
