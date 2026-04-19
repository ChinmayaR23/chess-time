package com.chesstime.repository;

import com.chesstime.model.User;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, String> {
    Optional<User> findByEmail(String email);
    Optional<User> findByProviderAndProviderId(String provider, String providerId);
    List<User> findByNameContainingIgnoreCaseAndIdNot(String name, String id, Pageable pageable);
}
