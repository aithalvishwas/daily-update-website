package com.dailyupdate.common;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.jdbc.datasource.DelegatingDataSource;
import org.springframework.stereotype.Component;

/**
 * Keeps each company's data apart inside the shared database.
 *
 * <p>Every company-owned table has a {@code company_id} column and a row-level security policy
 * that only shows rows of the company in the {@code app.company_id} setting. While a request has a
 * company ({@link TenantContext}), each connection switches to the {@value #ROLE} role, which the
 * policies apply to, and sets {@code app.company_id}. New rows get the company automatically from
 * the column default. Without a company (startup, schema setup) the connection keeps the service's
 * own login, which sees everything.
 */
@Component
public class TenantDatabase implements BeanPostProcessor, SmartInitializingSingleton {

    public static final String ROLE = "workpulse_tenant";

    private static final Logger log = LoggerFactory.getLogger(TenantDatabase.class);

    private DataSource raw;

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) {
        if (bean instanceof DataSource ds && !(bean instanceof TenantDataSource) && "dataSource".equals(beanName)) {
            raw = ds;
            return new TenantDataSource(ds);
        }
        return bean;
    }

    /** Creates the tenant role and lets it use this service's tables, after schema.sql has run. */
    @Override
    public void afterSingletonsInstantiated() {
        if (raw == null) {
            return;
        }
        try (Connection c = raw.getConnection(); var st = c.createStatement()) {
            try (var rs = st.executeQuery("SELECT 1 FROM pg_roles WHERE rolname = '" + ROLE + "'")) {
                if (!rs.next()) {
                    try {
                        st.execute("CREATE ROLE " + ROLE + " NOLOGIN");
                    } catch (SQLException e) {
                        // Another service created it at the same moment.
                        log.debug("Tenant role already exists", e);
                    }
                }
            }
            st.execute("GRANT " + ROLE + " TO CURRENT_USER");
            st.execute("GRANT USAGE ON SCHEMA public TO " + ROLE);
            st.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO " + ROLE);
            st.execute("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO " + ROLE);
        } catch (SQLException e) {
            throw new IllegalStateException("Could not set up company data isolation", e);
        }
    }

    static final class TenantDataSource extends DelegatingDataSource {

        TenantDataSource(DataSource target) {
            super(target);
        }

        @Override
        public Connection getConnection() throws SQLException {
            return scope(super.getConnection());
        }

        @Override
        public Connection getConnection(String username, String password) throws SQLException {
            return scope(super.getConnection(username, password));
        }

        private static Connection scope(Connection c) throws SQLException {
            Long company = TenantContext.current();
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT set_config('role', ?, false), set_config('app.company_id', ?, false)")) {
                ps.setString(1, company == null ? "none" : ROLE);
                ps.setString(2, company == null ? "" : company.toString());
                ps.execute();
            } catch (SQLException e) {
                c.close();
                throw e;
            }
            return c;
        }
    }
}
