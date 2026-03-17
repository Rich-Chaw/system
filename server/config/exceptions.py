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
    def __init__(self, message, status_code=400, payload=None):
        super().__init__(message, status_code, payload)


class ModelLoadError(FinderNDException):
    def __init__(self, message, status_code=500, payload=None):
        super().__init__(message, status_code, payload)


class DismantlingError(FinderNDException):
    def __init__(self, message, status_code=500, payload=None):
        super().__init__(message, status_code, payload)


class ValidationError(FinderNDException):
    def __init__(self, message, status_code=400, payload=None):
        super().__init__(message, status_code, payload)
