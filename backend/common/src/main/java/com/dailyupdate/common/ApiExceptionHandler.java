package com.dailyupdate.common;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** Turns exceptions into {"error": "..."} JSON without leaking internals. */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    ResponseEntity<Map<String, String>> api(ApiException e) {
        return error(e.status(), e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, String>> invalid(MethodArgumentNotValidException e) {
        var fieldError = e.getBindingResult().getFieldError();
        return error(400, fieldError != null ? fieldError.getDefaultMessage() : "Invalid request");
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<Map<String, String>> unreadable(HttpMessageNotReadableException e) {
        return error(400, "Invalid JSON");
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<Map<String, String>> mismatch(MethodArgumentTypeMismatchException e) {
        return error(400, "Invalid value for " + e.getName());
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    ResponseEntity<Map<String, String>> missingParam(MissingServletRequestParameterException e) {
        return error(400, "Missing " + e.getParameterName());
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    ResponseEntity<Map<String, String>> missingPart(MissingServletRequestPartException e) {
        return error(400, "Choose a file to upload");
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<Map<String, String>> tooLarge(MaxUploadSizeExceededException e) {
        return error(413, "Files can be at most 10 MB");
    }

    @ExceptionHandler(MultipartException.class)
    ResponseEntity<Map<String, String>> notMultipart(MultipartException e) {
        return error(400, "Send the file as a multipart upload");
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<Map<String, String>> notFound(NoResourceFoundException e) {
        return error(404, "Not found");
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<Map<String, String>> method(HttpRequestMethodNotSupportedException e) {
        return error(405, "Method not allowed");
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, String>> unexpected(Exception e) {
        log.error("Unhandled error", e);
        return error(500, "Internal server error");
    }

    private static ResponseEntity<Map<String, String>> error(int status, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message));
    }
}
